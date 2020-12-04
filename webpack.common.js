const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {

    entry: path.resolve(__dirname, './index.js'),

    output: {
        path: path.resolve(__dirname, './dist'),
        filename: "bundle.js",
    },

    plugins: [
        new CleanWebpackPlugin(),
    ],

    module: {
        rules: [
            {
                test: /\.s?[ac]ss$/i,
                use: ["style-loader", "css-loader", "sass-loader"],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.html$/i,
                use: ['file-loader?name=[name].[ext]', 'extract-loader',
                    {
                        loader: "html-loader",
                        options: {
                            attributes: {
                                list: [
                                    {
                                        attribute: "href",
                                        type: "src",
                                        tag: "link",
                                    },

                                ]
                            }
                        }
                    }
                ],
            },
        ],
    },
};
