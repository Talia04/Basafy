/**
 * One-time script: adds UniversalLinkOpener.m to the Xcode project.
 * Run with: node scripts/addNativeFile.js
 */
const xcode = require('xcode');
const path = require('path');
const fs = require('fs');

const pbxprojPath = path.join(
  __dirname,
  '../ios/Basafy.xcodeproj/project.pbxproj',
);

const project = xcode.project(pbxprojPath);
project.parseSync();

const filename = 'UniversalLinkOpener.m';
const filePath = `Basafy/${filename}`;

// Check if already registered
const refs = project.pbxFileReferenceSection();
const alreadyAdded = Object.values(refs).some(
  (ref) => ref && (ref.path === `"${filename}"` || ref.path === filename),
);

if (alreadyAdded) {
  console.log(`${filename} is already in the project. Nothing to do.`);
  process.exit(0);
}

const groupKey = project.findPBXGroupKey({ name: 'Basafy' });
if (!groupKey) {
  console.error('Could not find Basafy group in Xcode project.');
  process.exit(1);
}

project.addSourceFile(filePath, {}, groupKey);

fs.writeFileSync(pbxprojPath, project.writeSync());
console.log(`✓ Added ${filename} to Xcode project.`);
