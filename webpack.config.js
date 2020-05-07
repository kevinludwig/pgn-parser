const path = require('path'),
    {CleanWebpackPlugin} = require('clean-webpack-plugin'),
      TerserWebpackPlugin = require('terser-webpack-plugin');

const buildTarget = (library, libraryExport, libraryTarget, filename) => ({
    target: 'node',
    mode: 'production',
    entry: './src/index.js',
    resolve: {
        mainFields: ['module', 'main'],
        modules: ['./src', './node_modules'],
        extensions: ['.js']
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename,
        libraryTarget,
        libraryExport,
        library
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
                cache: true,
                parallel: true,
                sourceMap: true
            })
        ]
    }
});

module.exports = [
    buildTarget(undefined, 'default', 'commonjs2', 'bundle.node.js'),
    buildTarget('PgnParser', undefined, 'var', 'bundle.js')
];

