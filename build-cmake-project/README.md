# Build CMake-based project

This action builds a project based on CMake and run the provided tests

## Inputs

### `build-type`

The build type for CMake dependencies (default: `RelWithDebInfo`)

### `compiler` (Linux only)

If `compiler` is set to clang, all CMake dependencies will be built with clang. Otherwise it has no effect. (default: `gcc`)

### `options`

Pass extra CMake options

## Example usage

```yaml
uses: jrl-umi3218/github-actions/build-cmake-project@master
with:
  compiler: clang
  build-type: Debug
  options: -DENABLE_FFMPEG:BOOL=ON
```
