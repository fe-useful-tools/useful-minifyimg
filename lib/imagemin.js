"use strict";
const { promisify } = require("util");
const path = require("path");
const fs = require("graceful-fs");
const FileType = require("file-type");
const globby = require("globby");
const makeDir = require("make-dir");
const pPipe = require("p-pipe");
const replaceExt = require("replace-ext");
const junk = require("junk");

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const handleFile = async (
  sourcePath,
  { destination, deepCopy, plugins = [] },
  input
) => {
  if (plugins && !Array.isArray(plugins)) {
    throw new TypeError("The `plugins` option should be an `Array`");
  }

  let data = await readFile(sourcePath);
  data = await (plugins.length > 0 ? pPipe(...plugins)(data) : data);

  const { ext } = await FileType.fromBuffer(data);

  let destinationPath = undefined;

  if (destination && deepCopy) {
    const prefixPath = input.slice(0, input.indexOf("*"));
    const multiPath = sourcePath.replace(prefixPath, "");
    destinationPath = path.join(destination, multiPath);
  } else if (destination) {
    destinationPath = path.join(destination, path.basename(sourcePath));
  }

  destinationPath =
    ext === "webp" ? replaceExt(destinationPath, ".webp") : destinationPath;

  const returnValue = {
    data,
    sourcePath,
    destinationPath,
  };

  if (!destinationPath) {
    return returnValue;
  }

  await makeDir(path.dirname(returnValue.destinationPath));
  await writeFile(returnValue.destinationPath, returnValue.data);

  return returnValue;
};

module.exports = async (input, { glob = true, ...options } = {}) => {
  if (!Array.isArray(input)) {
    throw new TypeError(`Expected an \`Array\`, got \`${typeof input}\``);
  }

  const filePaths = glob ? await globby(input, { onlyFiles: true }) : input;

  return Promise.all(
    filePaths
      .filter((filePath) => junk.not(path.basename(filePath)))
      .map(async (filePath) => {
        try {
          return await handleFile(filePath, options, input[0]);
        } catch (error) {
          error.message = `Error occurred when handling file: ${input}\n\n${error.stack}`;
          throw error;
        }
      })
  );
};

module.exports.buffer = async (input, { plugins = [] } = {}) => {
  if (!Buffer.isBuffer(input)) {
    throw new TypeError(`Expected a \`Buffer\`, got \`${typeof input}\``);
  }

  if (plugins.length === 0) {
    return input;
  }

  return pPipe(...plugins)(input);
};
