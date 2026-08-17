import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const scheme = 'my.rapat.app';
const host = 'login-callback';

async function configureAndroid() {
  const path = 'android/app/src/main/AndroidManifest.xml';
  if (!existsSync(path)) return;
  let xml = await readFile(path, 'utf8');
  if (xml.includes(`android:scheme="${scheme}"`)) return;
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="${scheme}" android:host="${host}" />\n            </intent-filter>`;
  xml = xml.replace('</activity>', `${filter}\n        </activity>`);
  await writeFile(path, xml, 'utf8');
  console.log('Configured Android OAuth deep link.');
}

async function configureIOS() {
  const path = 'ios/App/App/Info.plist';
  if (!existsSync(path)) return;
  let plist = await readFile(path, 'utf8');
  if (plist.includes(`<string>${scheme}</string>`)) return;
  const urlTypes = `\n\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${scheme}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${scheme}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>`;
  plist = plist.replace('\n</dict>\n</plist>', `${urlTypes}\n</dict>\n</plist>`);
  await writeFile(path, plist, 'utf8');
  console.log('Configured iOS OAuth URL scheme.');
}

await configureAndroid();
await configureIOS();
