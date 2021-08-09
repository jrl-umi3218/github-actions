const cache = require('@actions/cache');
const core = require('@actions/core');
const exec = require('@actions/exec');

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function run()
{
  if(process.env.VCPKG_CACHE_KEY)
  {
    console.log(`Creating cache from folder: ${process.cwd()}`);
    console.log(`Remove extraneous stuff in ${process.env.VCPKG_ROOT}`);
    await bash(`rm -rf ${process.env.VCPKG_ROOT}/buildtrees`);
    await bash(`rm -rf ${process.env.VCPKG_ROOT}/packages`);
    await bash(`rm -rf ${process.env.VCPKG_ROOT}/downloads`);
    console.log(`Content after cleanup`);
    await bash(`ls -lR ${process.env.VCPKG_ROOT}`);
    await bash('ls -lR build/vcpkg_installed');
    const cache_paths = [process.env.VCPKG_ROOT, 'build/vcpkg_installed'];
    const cacheId = await cache.saveCache(cache_paths, process.env.VCPKG_CACHE_KEY);
  }
}

try
{
  run();
}
catch(error)
{
  core.setFailed(error.message);
}
