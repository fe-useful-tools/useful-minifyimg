#!/usr/bin/env node
"use strict";
const path = require("path");
const del = require("del");
const ora = require("ora");
const plur = require("plur");
const arrify = require("arrify");
const meow = require("meow");
const stripIndent = require("strip-indent");

const imagemin = require("./imagemin");

const DEFAULT_PLUGINS = ["gifsicle", "pngquant", "jpegtran", "svgo"];

// 组合配置文件和命令行
let CONFIG = {};

// 项目根目录配置文件
let MINIFY_IMG_CONFIG = {};
try {
  MINIFY_IMG_CONFIG = require(path.resolve(process.cwd(), "minifyimg.json"));
} catch (e) {}

const requirePlugins = (plugins) =>
  plugins.map((plugin) => {
    try {
      return require(`imagemin-${plugin}`)();
    } catch (_) {
      console.error(
        stripIndent(`
			Unknown plugin: ${plugin}
			Did you forget to install the plugin?
			You can install it with:
			  $ npm install -g imagemin-${plugin}
		`).trim()
      );

      process.exit(1);
    }
  });

const cli = meow(
  `
	Usage
	  $ minifyimg --input-dir=src/images/\*\*/\* --out-dir=assets/images --use-webp=true --deep-copy [--plugin=<name> ...]
	  $ minifyimg -i=src/images/\*\*/\* -o=assets/images -w=true -d [-p=<name> ...]
	Options
	  --input-dir, -i   Input directory
    --out-dir, -o     Output directory
	  --use-webp, -w    Convert resource format to webp
	  --deep-copy, -d   Deep copy resources to output directory
	  --plugin, -p      Override the default plugins
	Examples
    $ minifyimg --input-dir=src/images/\*\*/\* --out-dir=assets/images --use-webp=true --deep-copy --plugin=pngquant
    $ minifyimg -i=src/images/\*\*/\* -o=assets/images -w=true -d -p=pngquant -p=jpegtran
`,
  {
    description: "minifyimg CLI",
    flags: {
      inputDir: {
        type: "string",
        alias: "i",
        default: "src/images/**/*",
      },
      outDir: {
        type: "string",
        alias: "o",
        default: "assets/images",
      },
      useWebp: {
        type: "boolean",
        alias: "w",
        default: false,
      },
      deepCopy: {
        type: "boolean",
        alias: "d",
        default: true,
      },
      plugin: {
        type: "string",
        alias: "p",
      },
    },
  }
);

const run = async ({
  inputDir,
  outDir,
  useWebp,
  deepCopy,
  plugin = DEFAULT_PLUGINS,
} = {}) => {
  const pluginArr = arrify(plugin);
  const usePlugin = useWebp ? [...pluginArr, "webp"] : pluginArr;
  const plugins = requirePlugins(usePlugin);
  const spinner = ora("Minifying images");

  spinner.start();

  let files;
  try {
    files = await imagemin([inputDir], {
      destination: outDir,
      deepCopy,
      plugins,
    });
  } catch (error) {
    throw error;
  } finally {
    spinner.stop();
  }

  console.log(`${files.length} ${plur("image", files.length)} minified`);
};

(async () => {
  CONFIG = Object.assign({}, cli.flags, MINIFY_IMG_CONFIG);

  const deletedPaths = await del([path.resolve(process.cwd(), CONFIG.outDir)]);
  console.log(
    "Files and directories that would be deleted:\n",
    deletedPaths.join("\n")
  );

  await run(CONFIG);
})();
