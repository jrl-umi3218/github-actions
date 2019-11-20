# Get Eigen library

This action installs the Eigen library on the host runner.

## Inputs

### `install-prefix`

**Required** Where the Eigen library is installed. This is only used on Windows hosts. Default `C:\devel\install`.

## Example usage

```yaml
uses: jrl-umi3218/github-actions/get-eigen@master
with:
  install-prefix: 'C:\devel\install'
```
