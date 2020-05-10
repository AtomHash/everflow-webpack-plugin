const exec = require('child_process').exec;
const fs = require('fs-extra');
const path = require('path');
const merge = require('deepmerge');

//const CopyWebpackPlugin = require('copy-webpack-plugin');

class EverflowWebpackPlugin {

    constructor(options =   {}) {
        // Run scripts before dev server starts
        this.runner();
    }

    runner() {
        console.log('Everflow: Running scripts...');

        // Run everflow script magic(Routes and stores)
        exec('node ./node_modules/@everflow-cli/tools/magic-routes.js', (err, stdout, stderr) => {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
        });
    }

    apply(compiler) {
        const distPath = compiler.options.output.path;
        const appPath = compiler.options.resolve.alias['@'];
        const everflowI18nFolder = 'i18n';

        const camelCase = function(str)
        {
            /* CREDIT: briosheje @ stackoverflow | Refactored.*/
            let capital =  str.split('-').map(
                                              (item, index) => index ? item.charAt(0).toUpperCase() + item.slice(1).toLowerCase() : item);
            return capital.join("");
        }

        const uniqueArray = function(value, index, self)
        {
            /* CREDIT: TLindig @ stackoverflow | Function name changed */
            return self.indexOf(value) === index;
        }

        const getLocales = function(pathToLocales)
        {
            if(!fs.existsSync(pathToLocales))
            {
                return;
            }
            let filesOfLocalePath = fs.readdirSync(pathToLocales);
            let fullFileLocales = {
                localeFiles: {},
                locales: []
            };
            filesOfLocalePath.forEach(function(file)
            {
                let localePath = path.join(pathToLocales, file)
                if (fs.statSync(localePath).isDirectory())
                {
                    // No directories!
                    return false;
                }
                let locale = file.split('.')[0];
                fullFileLocales.locales.push(locale);
                fullFileLocales.localeFiles[locale] = {localeFileName: file, localePath: localePath};
            });
            return fullFileLocales;
        }

        const getModules = function()
        {
            const srcModulesPath = path.join(appPath, 'modules');
            let everflowModules = {
                allLocales: [],
                modules: []
            };
            //a.filter( onlyUnique ); 
            for (let folder of fs.readdirSync(srcModulesPath))
            {
                let modulePath = path.join(srcModulesPath, folder);
                if (fs.statSync(modulePath).isDirectory())
                {
                    let moduleLocalePath = path.join(modulePath, everflowI18nFolder);
                    if(!fs.existsSync(moduleLocalePath))
                    {
                        fs.mkdirSync(moduleLocalePath);
                    }
                    let importName = camelCase(folder);
                    let moduleLocales = getLocales(moduleLocalePath);
                    everflowModules.allLocales.push(...moduleLocales.locales);
                    everflowModules.modules.push({
                        importName: importName,
                        locales: moduleLocales,
                        folder: folder
                    })
                }
            }

            // load ./src/i18n files too...
            let rootLocalesPath = path.join(appPath, everflowI18nFolder)
            let rootModule = {
                importName: "__everflow_root_module",
                locales: getLocales(rootLocalesPath),
                folder: everflowI18nFolder
            }
            everflowModules.allLocales.push(...rootModule.locales.locales);
            everflowModules.modules.push(rootModule);
            everflowModules.allLocales = everflowModules.allLocales.filter(uniqueArray); 
            return everflowModules;
        }

        const mergeLocales = function(everflowModules)
        {
            let modulesMissingLocales = [];
            let toMergeLocales = {};
            let evgenLocalesPath = path.join(appPath, everflowI18nFolder, 'evgen');
            if(!fs.existsSync(evgenLocalesPath))
            {
                fs.mkdirSync(evgenLocalesPath);
            }
            everflowModules.allLocales.forEach(function(locale){
                let evgenLocalePath = path.join(appPath, everflowI18nFolder, 'evgen', locale+".json");

                // Set {locale: {}} to file...
                let newLocale = {};
                newLocale[locale] = {};
                fs.writeJsonSync(evgenLocalePath, newLocale, {
                    spaces: 2,
                    encoding: 'utf8'
                });

                // Get modules option from evconfig
                let everflowConfig = fs.readJsonSync(path.join(appPath, 'evconfig.json'), { encoding: 'utf8' });
                let i18nModules = everflowConfig.i18n.modules;

                everflowModules.modules.forEach(function(module){
                    var localeFiles = module.locales.localeFiles[locale];
                    if (localeFiles)
                    {
                        let evgenLocaleJson = fs.readJsonSync(evgenLocalePath, { encoding: 'utf8' });
                        let moduleLocaleJson = fs.readJsonSync(localeFiles.localePath, { encoding: 'utf8' });
                        // Easy way to make sure root modules are at root level of the output json file.
                        if (module.importName === '__everflow_root_module')
                        {
                            i18nModules = !i18nModules;
                        }
                        // If modules are enabled in the i18n config in evconfig.json
                        if (i18nModules)
                        {
                            evgenLocaleJson[locale][module.importName] = {...moduleLocaleJson};
                        } else {
                            evgenLocaleJson[locale] = merge(evgenLocaleJson[locale], moduleLocaleJson);
                        }
                        // Easy way to make sure root modules are at root level of the output json file.
                        if (module.importName === '__everflow_root_module')
                        {
                            i18nModules = !i18nModules;
                        }
                        fs.writeJsonSync(evgenLocalePath, evgenLocaleJson, {
                            spaces: 2,
                            encoding: 'utf8'
                        });
                    } else {
                        let dir = '';
                        let mo = '';
                        if (module.importName === '__everflow_root_module')
                        {
                            dir = './src/';
                            mo = '';
                        } else{
                            dir = './src/modules/';
                            mo = 'module';
                        }
                        // module does not support all languages supported by your app...
                        console.log('\x1b[30m\x1b[43m%s\x1b[0m', 'WARNING!', `${dir}${module.folder} ${mo} is missing "${locale}" locale for i18n`);
                    }
                });
            });
        }

        const copyLocales = function(files, sourcePath, destPath)
        {
            if(!fs.existsSync(destPath))
            {
                fs.mkdirSync(destPath);
            }
            files.forEach(function(file){
                const fromPath = path.join(sourcePath, file);
                const toPath = path.join(destPath, file);
                fs.copy(fromPath, toPath, function (err) {});
            });
        }

        // i18n loading
        let everflowConfig = fs.readJsonSync(path.join(appPath, 'evconfig.json'), { encoding: 'utf8' });
        if (!everflowConfig.i18n)
        {
            throw new Error( './src/evconfig.json requires i18n prop to be set.' )
            return false;
        }
        let appIsI18nEnabled = everflowConfig.i18n.enabled;
        if (appIsI18nEnabled)
        {
            const srcLocalesPath = path.join(appPath, everflowI18nFolder, 'evgen');
            const distLocalesPath = path.join(distPath, everflowI18nFolder);
            
            // Make sure the dist(publish) folder exists
            if(!fs.existsSync(distPath))
            {
                fs.mkdirSync(distPath);
            }
            if(!fs.existsSync(path.join(appPath, everflowI18nFolder)))
            {
                fs.mkdirSync(path.join(appPath, everflowI18nFolder));
            }
            if(!fs.existsSync(path.join(appPath, everflowI18nFolder, 'evgen')))
            {
                fs.mkdirSync(path.join(appPath, everflowI18nFolder, 'evgen'));
            }
            let everflowModules = getModules();
            // Tell the user about their i18n support... because why not...
            console.log('\x1b[30m\x1b[42m%s\x1b[0m', 'FUN FACT', `Your app supports ${everflowModules.allLocales} locales. Awesome.`);
            mergeLocales(everflowModules);

            const filesOfLocales = fs.readdirSync(srcLocalesPath);
            if(fs.existsSync(srcLocalesPath))
            {
                copyLocales(filesOfLocales, srcLocalesPath, distLocalesPath);
            }
        }



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