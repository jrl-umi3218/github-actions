# Build conan package and upload them

This action builds a conan package and uploads it. It can upload to a stable channel or a dev channel. The choice is made based on the action trigger:
- on `master` or after a `conan-master` dispatch it will upload to the dev channel
- on tags or after a `conan-release` dispatch it will upload to the stable channel

## Inputs

### `package`

The name of the package

### `user`

The bintray username

### `repository`

The bintray repository

A remote `https://api.bintray.com/conan/${{user}}/${{repository}}` is added to conan and used for upload if needed

### `stable-channel`

Channel used for stable releases

### `dev-channel`

Channel used for development releases

### `with-build-type`

If true the action will build one package with `build_type=Debug` and one with `build_type=Release`

### `force-upload`

Upload the package regardless of the branch

### `BINTRAY_API_KEY`

API key used to upload packages

## Example usage

```yaml
uses: jrl-umi3218/github-actions/build-conan-package@master
with:
  package: Eigen3ToPython
  user: gergondet
  repository: multi-contact
  stable-channel: stable
  dev-channel: dev
  BINTRAY_API_KEY: ${{ secrets.BINTRAY_API_KEY }}
```
