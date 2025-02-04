const fs = require('fs');
const path = require('path');

const targetContent = `"use strict";
// Copyright Datastax, Inc
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
`;

function deleteEmptyFiles(dirPath) {
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      return console.error('Unable to scan directory: ' + err);
    }

    files.forEach(file => {
      const filePath = path.join(dirPath, file);

      fs.stat(filePath, (err, stat) => {
        if (err) {
          return console.error('Error stating file: ' + err);
        }

        if (stat.isDirectory()) {
          deleteEmptyFiles(filePath);
          return;
        }

        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            return console.error('Error reading file: ' + err);
          }

          if (data === targetContent) {
            fs.unlink(filePath, (err) => err && console.error('Error deleting file: ' + err));
          }
        });
      });
    });
  });
}

deleteEmptyFiles('./dist');
