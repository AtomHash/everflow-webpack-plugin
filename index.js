const exec = require('child_process').exec;

class EverflowWebpackPlugin {

    constructor(options =   {}) {
        this.runner();
    }

    runner() {
        console.log('Everflow: Running scripts...');
        exec('node ./node_modules/@everflow-cli/tools/magic-routes.js', (err, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
        });
    }

    apply(compiler) {

        let initalRun = true;
        compiler.hooks.invalid.tap('EverflowWebpack', (fileName, changeTime) => {
            if (!initalRun)
            {
                this.runner();
            }
        });
        compiler.hooks.done.tap('EverflowWebpack', (stats ) => {
            initalRun = false;
        });
    }
}

module.exports = EverflowWebpackPlugin;