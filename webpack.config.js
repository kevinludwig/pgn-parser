const path = require('path'),
    {CleanWebpackPlugin} = require('clean-webpack-plugin'),
      TerserWebpackPlugin = require('terser-webpack-plugin');

module.exports = {
    mode: process.env['NODE_ENV'] === 'production' ? 'production' : 'development',
    entry: './src/index.js',
    devtool: 'source-map',
    resolve: {
        mainFields: ['module', 'main'],
        modules: ['./src', './node_modules'],
        extensions: ['.js']
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'pgn-parser.js',
        library: 'pgnParser',
        globalObject: 'this',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    module: {
        rules: [
            {
                test: /\.peg$/,
                use: [
                    {
                        loader: 'raw-loader',
                        options: {
                            esModule: false
                        }
                    }
                ]
            }
        ]
    },
    optimization: {
        minimizer: [
            new TerserWebpackPlugin({
                parallel: true,
                terserOptions: {
                    sourceMap: true
                }
            })
        ]
    },
    plugins: [
        new CleanWebpackPlugin()
    ]
};

