const { merge } = require('webpack-merge');

module.exports = merge(require('./webpack.common'), {
    mode: "development",
    devtool: "inline-source-map",
    devServer: {
        contentBase: '/dist',
        publicPath: '/',
        port: 8080,
    }
});
