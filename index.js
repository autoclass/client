import './index.scss';
import * as $ from 'jquery';
import 'bootstrap';
import './index.html';

import { io } from 'socket.io-client';

import * as sha1 from "sha-1";

function listItems(items) {
    return items?.map(i => `<li class="list-group-item text-muted text-monospace">
                                ${i}
                                <button type="button" class="close" aria-label="Delete" data-id="${i}" onclick="(function n(){v = new Event('deleteFileSound'); v.whom=this; document.dispatchEvent(v)}).call(this)">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </li>`) || "";
}

const logBuffer = {
    buf: [],
    listeners: [],
    maxSize: 500,
    push(str) {
        this.buf.push(str);
        this.listeners.forEach(f => f(str, this.buf));
        if(this.maxSize === this.buf.length) {
            this.buf.shift();
        }
    }
};

(async function(){
    // ldb
    !function(){function e(t,o){return n?void(n.transaction("s").objectStore("s").get(t).onsuccess=function(e){const t=e.target.result&&e.target.result.v||null;o(t)}):void setTimeout(function(){e(t,o)},100)}var t=window.indexedDB||window.mozIndexedDB||window.webkitIndexedDB||window.msIndexedDB;if(!t)return void console.error("indexDB not supported");var n,o={k:"",v:""},r=t.open("d2",1);r.onsuccess=function(e){n=this.result},r.onerror=function(e){console.error("indexedDB request error"),console.log(e)},r.onupgradeneeded=function(e){n=null;var t=e.target.result.createObjectStore("s",{keyPath:"k"});t.transaction.oncomplete=function(e){n=e.target.db}},window.ldb={get:e,set:function(e, t){o.k=e,o.v=t,n.transaction("s","readwrite").objectStore("s").put(o)}}}();
    ldb.get = (f => (...args) => new Promise(resolve => f.apply(this, args.push(r => resolve(r)) && args) ))(ldb.get);

    const username = {
        _u: '',
        _listeners: [],
        get() { return this._u; },
        set(val) {
            this._u = val;
            ldb.set("username", val);
            this._listeners.forEach(f => f(this._u));
        }
    }

    $(
        () => {
            const $logWindow = $('#log-window');
            logBuffer.listeners.push((_, buf) => {
                $logWindow.text(buf.reduce((acc, x) => acc + x + '\n', '')).scrollTop($logWindow[0].scrollHeight - $logWindow.height())
            });
        }
    )

    $(
        () => {
            username._listeners.push(u => {
                $( $('#username').val(u) );
            })
            $("#usernameForm").submit(e => {
                e.preventDefault();

                $(`
                    <div class="alert alert-info alert-dismissible fade show" role="alert">
                        <strong>Konekcija izvršena!</strong> Eventualne greške/logovi se nalaze u konzoli (F12).
                        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                `).hide().appendTo('#overlay').slideDown('normal').delay(3500).fadeOut();
                username.set($("#username").val());
            });
        }
    );

    const _username = await ldb.get("username");
    if(_username) username.set(_username);


    // SHA-1 -> File
    const _files = JSON.parse(await ldb.get("files"));
    const files = (_files && new Map(_files)) || new Map();

    // Name -> [SHA-1]
    const _sounds = JSON.parse(await ldb.get("sounds"));
    const sounds =  (_sounds && new Map(_sounds)) || new Map();

    const socket = io('http://localhost:3000');
    const connect = () => {
        socket.emit('new user', {
            username: username.get(),
            sounds: Array.from(sounds.keys()),
        });
        logBuffer.push(`[${new Date().toTimeString().split(' ')[0]}] Connected!`);
    };

    socket.on('connect', connect);
    socket.on('disconnect', error => {
        logBuffer.push(`[${new Date().toTimeString().split(' ')[0]}] Disconnected! (${error})`);
        console.error("Disconnected!", error)
    });
    socket.on('connect_error', error => {
        logBuffer.push(`[${new Date().toTimeString().split(' ')[0]}] Could not connect! (${error})`);
        console.error("Could not connect!", error)
    });
    socket.on('play', async ({sound}) => {
        const soundHashes = sounds.get(sound);
        if(!soundHashes) return;

        const hash = soundHashes[Math.floor(Math.random() * soundHashes.length)];
        const blob = files.get(hash);

        const audio = new Audio(URL.createObjectURL(blob));
        audio.onloadedmetadata = e => URL.revokeObjectURL(audio.src);

        await fetch(`http://localhost:3001/mute?length=${Math.ceil(audio.duration) + 2}`);
        audio.play();

        logBuffer.push(`[${new Date().toTimeString().split(' ')[0]}] Played sound ${sound}/${hash}`);
    });
    socket.on('leave', async () => {
        await fetch('http://localhost:3001/leave');
        logBuffer.push(`[${new Date().toTimeString().split(' ')[0]}] Left current class`);
    })
    socket.on('unmute', async ({length}) => {
        await fetch(`http://localhost:3001/mute?length=${length}`)
        logBuffer.push(`[${new Date().toTimeString().split(' ')[0]}] Unmuted for ${length}s`);
    });
    socket.on('join', async ({platform, opts}) => {
        await fetch(`http://localhost:3001/join?platform=${platform}&opts=${opts}`)
        logBuffer.push(`[${new Date().toTimeString().split(' ')[0]}] Joined class on ${platform}`);
    });

    username._listeners.push(async u => {
        await socket.disconnect();
        await socket.connect();
    });

    let soundsChangeListener = () => {
        socket.emit("update", Array.from(sounds.keys()));
        $('#sounds-select').html(`
            ${Array.from(sounds.keys()).map(k => `
                <option value="${k}">${k}</option>
            `)}
        `);
        $('#sound-hash-list').html(listItems(sounds.get($('#sounds-select').val())));
    }
    soundsChangeListener();

    $(
        () => {
            $(document).on('deleteFileSound', function (e) {
                const id = e.originalEvent.whom.getAttribute("data-id");
                for (let [key, value] of sounds.entries()) {
                    sounds.set(key, value.filter(x => x !== id));
                    if(!sounds.get(key).length)
                        sounds.delete(key);
                }
                files.delete(id);
                ldb.set("sounds", JSON.stringify(Array.from(sounds.entries())));
                ldb.set("files", JSON.stringify(Array.from(files.entries())));
                soundsChangeListener();
            })
        }
    );

    $(
        () => {
            const addFileToSounds = async () => {
                const file = $("#fileUpload").prop('files')[0];
                const hash = await sha1(await file.text());
                const filename = $("#filename").val();

                if(!file.type.startsWith('audio/')) {
                    $(`
                        <div class="alert alert-danger alert-dismissible fade show" role="alert">
                            <strong>Odabrani fajl nije audio fajl.</strong> Odaberite audio fajl (mp3, ogg, wav, ...).
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                    `).hide().appendTo('#overlay').slideDown('normal').delay(3500).fadeOut();
                }

                if(sounds.get(filename) === undefined) {
                    sounds.set(filename, [hash]);
                } else {
                    sounds.get(filename).push(hash);
                }
                files.set(hash, file);

                ldb.set("sounds", JSON.stringify(Array.from(sounds.entries())));
                ldb.set("files", JSON.stringify(Array.from(files.entries())));

                console.log(`Added file '${filename}' (${hash})`);
                if(soundsChangeListener) soundsChangeListener();
            };

            $("#fileUploadForm").submit(async e => {
                e.preventDefault();
                await addFileToSounds();
            });
        }
    );

    $(() => $('#sounds-select').change(() => $('#sound-hash-list').html(listItems(sounds.get($('#sounds-select').val())))))
})();
