const exec = require('child_process').exec;

class EverflowWebpackPlugin {

    constructor(options =   {}) {
        // Run scripts before dev server starts
        this.runner();
    }

    runner() {
        console.log('Everflow: Running scripts...');

        // Run everflow script magic(Routes etc...)
        exec('node ./node_modules/@everflow-cli/tools/magic-routes.js', (err, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
        });
    }

    apply(compiler) {

        // Make sure the load happy watcher does not compile newly generated files
        let initalRun = true;

        compiler.hooks.invalid.tap('EverflowWebpackPlugin', (fileName, changeTime) => {
            if (!initalRun)
            {
                this.runner();
            }
        });
        compiler.hooks.done.tap('EverflowWebpackPlugin', (stats ) => {
            initalRun = false;
        });
    }
}

module.exports = EverflowWebpackPlugin;