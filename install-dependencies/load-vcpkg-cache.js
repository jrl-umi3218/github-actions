const cache = require('@actions/cache');
const core = require('@actions/core');
const crypto = require('crypto');
const exec = require('@actions/exec');
const fs = require('fs');
const yaml = require('js-yaml');

async function get_os_name()
{
  if(process.platform == 'linux')
  {
    let dist_name = '';
    const options = {};
    options.listeners = {
      stdout: (data) => {
        dist_name += data.toString();
      }
    };
    await exec.exec('lsb_release', ['-sc'], options);
    dist_name = dist_name.trim();
    return `${process.platform}_${dist_name}`;
  }
  else
  {
    return process.platform;
  }
}

function hash(file)
{
  if(!fs.existsSync(file))
  {
    return '0';
  }
  const fb = fs.readFileSync(file);
  const hasher = crypto.createHash('sha1');
  hasher.update(fb);
  return hasher.digest('hex');
}

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function handle_vcpkg(vcpkg, compiler)
{
  if(!vcpkg)
  {
    return;
  }
  if(!vcpkg.repo)
  {
    throw new Error(`vcpkg object must have a repo member!\nGot:\n${vcpkg}\n`);
  }
  core.startGroup("Remove existing installation in GitHub environment");
    await bash('rm -rf "$VCPKG_INSTALLATION_ROOT" || sudo rm -rf "$VCPKG_INSTALLATION_ROOT"');
  core.endGroup();
  core.startGroup('Restore vcpkg cache');
    await exec.exec('git clone --recursive https://github.com/' + vcpkg.repo);
    const cwd = process.cwd();
    const vcpkg_org = vcpkg.repo.split('/')[0];
    const vcpkg_dir = vcpkg.repo.split('/')[1];
    const vcpkg_exe = `./${vcpkg_dir}/vcpkg`;
    core.exportVariable('VCPKG_EXE', `${vcpkg_exe}`);
    core.exportVariable('VCPKG_ROOT', `${vcpkg_dir}`);
    core.exportVariable('VCPKG_TOOLCHAIN', `${process.cwd()}/scripts/buildsystems/vcpkg.cmake`);
    core.exportVariable('VCPKG_FEATURE_FLAGS', 'manifests,registries');
    if(process.platform === 'win32')
    {
      core.exportVariable('VCPKG_DEFAULT_TRIPLET', 'x64-windows');
    }
    process.chdir(vcpkg_dir);
    let vcpkg_hash = '';
    const options = {};
    options.listeners = {
      stdout: (data) => {
        vcpkg_hash += data.toString();
      }
    };
    await exec.exec('git', ['rev-parse', 'HEAD'], options);
    vcpkg_hash = vcpkg_hash.trim();
    process.chdir(cwd);
    const cache_key = `vcpkg_${await get_os_name()}-${vcpkg_hash}-${hash('vcpkg.json')}-${hash('vcpkg-configuration.json')}`;
    const cache_paths = [vcpkg_dir, 'build/vcpkg_installed'];
    const cache_restore_keys = ['vcpkg-'];
    const cache_hit = await cache.restoreCache(cache_paths, cache_key, cache_restore_keys);
  core.endGroup();
  if(cache_hit == cache_key)
  {
    return;
  }
  core.exportVariable('VCPKG_CACHE_KEY', cache_key);
  let vcpkg_prev_hash = '';
  if(cache_hit)
  {
    vcpkg_prev_hash = cache_hit.split('-')[1];
  }
  process.chdir(vcpkg_dir);
  if(vcpkg_prev_hash != vcpkg_hash)
  {
    core.startGroup('Bootstrap vcpkg');
    if(process.platform === 'win32')
    {
      await bash('./bootstrap-vcpkg.bat');
    }
    else
    {
      if(process.platform === 'linux')
      {
        if(compiler === 'gcc')
        {
          core.exportVariable('CXX', 'g++');
        }
        else
        {
          core.exportVariable('CXX', 'clang++');
        }
        await bash('./bootstrap-vcpkg.sh');
      }
      else
      {
        await bash('./bootstrap-vcpkg.sh -allowAppleClang');
      }
    }
    core.endGroup();
  }
  core.startGroup('Remove outdated packages');
    await exec.exec(`${vcpkg_exe} remove --outdated --recurse`);
  core.endGroup();
}

try
{
  if(process.platform === 'win32')
  {
    const input = yaml.safeLoad(core.getInput('windows'));
    const vcpkg = (input && input.vcpkg) || yaml.safeLoad(core.getInput('vcpkg'));
    handle_vcpkg(vcpkg, '');
  }
  else if(process.platform === 'darwin')
  {
    const input = yaml.safeLoad(core.getInput('macos'));
    const vcpkg = (input && input.vcpkg) || yaml.safeLoad(core.getInput('vcpkg'));
    handle_vcpkg(vcpkg, '');
  }
  else
  {
    const input = yaml.safeLoad(core.getInput('ubuntu'));
    const vcpkg = (input && input.vcpkg) || yaml.safeLoad(core.getInput('vcpkg'));
    handle_vcpkg(vcpkg, '');
  }
}
catch(error)
{
  core.setFailed(error.message);
}
