const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function bash_out(cmd)
{
  let output = '';
  const options = {};
  options.listeners = {
    stdout: (data) => {
      output += data.toString();
    }
  };
  await exec.exec('bash', ['-c', cmd], options);
  return output.trim();
}

async function run()
{
  try
  {
    // Get options
    const package = core.getInput('package');
    const user = core.getInput('user');
    const repository = core.getInput('repository');
    const remote = `https://api.bintray.com/conan/${user}/${repository}`
    const stable_channel = core.getInput('stable-channel');
    const dev_channel = core.getInput('dev-channel');
    const BINTRAY_API_KEY = core.getInput('BINTRAY_API_KEY');
    // Get GitHub context
    const context = github.context;
    // Check if this action is running on a tag
    const run_on_tag = context.ref.startsWith('refs/tags/');
    // Install conan
    core.startGroup('Install and setup conan');
    let sudo = '';
    const linux = process.platform == 'linux';
    const darwin = process.platform == 'darwin';
    const win32 = process.platform == 'win32';
    let sed = 'sed';
    if(linux)
    {
      await bash('sudo apt install python3-setuptools');
      await bash('sudo apt remove python3-jwt python3-jinja2');
      sudo = 'sudo';
    }
    if(darwin)
    {
      await bash('brew install gnu-sed');
      sed = 'gsed';
    }
    await bash(`${sudo} pip3 install conan`);
    await bash(`conan remote add ${repository} ${remote}`)
    if(linux)
    {
      await bash('conan profile new default --detect');
      await bash('conan profile update settings.compiler.libcxx=libstdc++11 default');
    }
    core.endGroup();
    // Determine build and upload parameters
    core.startGroup('Set build and upload parameters');
    let package_stable = false;
    let package_upload = false;
    if(context.action == 'conan-master')
    {
      package_stable = false;
      package_upload = true;
    }
    else if(context.action == 'conan-release')
    {
      package_stable = true;
      package_upload = true;
      await bash('git checkout `git tag --sort=committerdate --list \'v[0-9]*\' | tail -1`');
      await bash('git submodule sync && git submodule update --init');
    }
    else
    {
      package_stable = run_on_tag;
      package_upload = run_on_tag || context.ref == 'refs/heads/master';
    }
    const package_version = await bash_out(`${sed} -E -e's/^    version = "(.*)"$/\\1/;t;d' conanfile.py`)
    let package_channel = dev_channel;
    if(package_stable)
    {
      package_channel = stable_channel;
    }
    await bash(`${sed} -i -e's@${repository}/${dev_channel}@${repository}/${package_channel}@' conanfile.py`);
    await bash(`${sed} -i -e's@${repository}/${dev_channel}@${repository}/${package_channel}@' conanfile.py`);
    await bash('conan info .');
    core.info(`Package channel: ${package_channel}`);
    core.info(`Package upload: ${package_upload}`);
    core.info(`Package version: ${package_version}`);
    core.endGroup();
    core.startGroup('Create conan package');
    await bash(`conan create . ${repository}/${package_channel}`);
    core.endGroup();
    if(package_upload)
    {
      core.startGroup('Upload conan package');
      await bash(`conan user -p ${BINTRAY_API_KEY} -r ${repository} ${user}`);
      await bash(`conan alias ${package}/latest@${repository}/${package_channel} ${package}/${package_version}@${repository}/${package_channel}`);
      await bash(`conan upload ${package}/${package_version}@${repository}/${package_channel} --all -r=${repository}`);
      await bash(`conan upload ${package}/latest@${repository}/${package_channel} --all -r=${repository}`);
      if(package_stable)
      {
        core.setOutput('dispatch', 'conan-release');
      }
      else
      {
        core.setOutput('dispatch', 'conan-master');
      }
      core.endGroup();
    }
    else
    {
      core.setOutput('dispatch', '');
    }
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
