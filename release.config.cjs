module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node -e "const fs = require(\'fs\'); const tauriConf = JSON.parse(fs.readFileSync(\'src-tauri/tauri.conf.json\', \'utf8\')); tauriConf.version = \'${nextRelease.version}\'; fs.writeFileSync(\'src-tauri/tauri.conf.json\', JSON.stringify(tauriConf, null, 2) + \'\\n\'); let cargo = fs.readFileSync(\'src-tauri/Cargo.toml\', \'utf8\'); cargo = cargo.replace(/^version = \\\"[^\\\"]+\\\"/m, \'version = \\\"${nextRelease.version}\\\"\'); fs.writeFileSync(\'src-tauri/Cargo.toml\', cargo);"',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
};
