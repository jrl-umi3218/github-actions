# Install dependencies

This action install dependencies on Ubuntu, macOS and Windows.

## Inputs

### `ubuntu`

Handle dependencies specific to Ubuntu

This input string is supposed to be a valid yaml object with the following entries. None are required.

#### `ppa`

Adds the provided ppa to the machine

#### `apt`

`apt install` the provided packages

#### `apt-mirrors`

Add apt mirrors to the machine, each entry must be a valid yaml object with the following properties:
- `mirror`: the mirror URI
- `key`: the GPG key used to sign packages on the mirror; OR
- `key-uri`: an URI to get the GPG key used to sign packages on the mirror
- `cloudsmith`: a cloudsmith stub to setup a cloudsmith mirror (e.g `mc-rtc/head`)

**Example**

```yaml
apt-mirrors:
  multi-contact:
    mirror: https://dl.bintray.com/gergondet/multi-contact-head
    key: 892EA6EE273707C6495A6FB6220D644C64666806
  ros:
    mirror: http://packages.ros.org/ros/ubuntu
    key-uri: http://packages.ros.org/ros.key
  mc-rtc:
    cloudsmith: mc-rtc/head
```

#### `pip`

`pip install` the provided packages (with `pip` *and* `pip3`)

#### `options`

Extra CMake options passed to all GitHub dependencies

#### `github`

See `github` input

#### `vcpkg`

See `vcpkg` input

### `macos`

Handle dependencies specific to macOS

This input string is supposed to be a valid yaml object with the following entries. None are required.

#### `brew-taps`

Add the provided taps to homebrew

#### `brew`

`brew install` the provided packages

#### `cask`

`brew cask install` the provided packages

#### `pip`

`pip install` the provided packages (with `pip` *and* `pip3`)

#### `options`

Extra CMake options passed to all GitHub dependencies

#### `github`

See `github` input

#### `vcpkg`

See `vcpkg` input

### `windows`

Handle dependencies specific to Windows

This input string is supposed to be a valid yaml object with the following entries. None are required.

#### `choco`

`choco install` the provided packages

#### `pip`

`pip install` the provided packages (only use `pip`)

#### `options`

Extra CMake options passed to all GitHub dependencies

#### `github`

See `github` input

#### `vcpkg`

See `vcpkg` input

### `github`

Other CMake-based packages to build

This input string is supposed to be a valid yaml list of object. Each object must have the following entries:

#### `path`

**Required** The GitHub path (e.g. for `https://github.com/jrl-umi3218/github-actions` this is `jrl-umi3218/github-actions`)

#### `ref`

The git reference to fetch (defaults to `master`)

#### `options`

Extra CMake options for the build

#### `linux-options`

Pass extra CMake options in Linux host. Those are passed after `options`

#### `macos-options`

Pass extra CMake options in macOS host. Those are passed after `options`

#### `windows-options`

Pass extra CMake options in Windows host. Those are passed after `options`

### `build-type`

The build type for CMake dependencies (default: `RelWithDebInfo`)

### `compiler` (Linux only)

If `compiler` is set to clang, all CMake dependencies will be built with clang. Otherwise it has no effect. (default: `gcc`)

### `options`

Pass extra CMake options.

### `linux-options`

Pass extra CMake options in Linux host. Those are passed after `options`

### `macos-options`

Pass extra CMake options in macOS host. Those are passed after `options`

### `windows-options`

Pass extra CMake options in Windows host. Those are passed after `options`

### `vcpkg`

If non-empty install vcpk on the host and use a manifest to install required dependencies. Set the VCPK\_TOOLCHAIN environment variable for the remainder of the build. It should be a valid yaml object with the following entries. The action automatically creates a cache for vcpkg packages.

#### `repo`

The repository that should be cloned as vcpkg


**Example**

```yaml
vcpkg:
  repo: microsoft/vcpkg
```

## Example usage

```yaml
uses: jrl-umi3218/github-actions/install-dependencies@master
with:
  compiler: clang
  ubuntu: |
    ppa: pierre-gergondet+ppa/multi-contact-unstable
    apt: libeigen3-dev libspacevecalg-dev
    pip: Cython coverage nose numpy
  macos: |
    brew: eigen
    pip: Cython coverage nose numpy
  windows: |
    pip: Cython coverage nose numpy
    github:
      - path: eigenteam/eigen-git-mirror
        ref: 3.3.7
  github:
    - path: jrl-umi3218/Eigen3ToPython
```

## Passing of CMake options

For a given `github` entry, CMake options are passed in the following order:
1. Global `options`
2. Platform-specific global options (e.g. `linux-options`)
3. Host-level options (e.g. `linux: options`) -- This does not apply to the common GitHub dependencies
4. Project `options`
5. Project platform-specific options
