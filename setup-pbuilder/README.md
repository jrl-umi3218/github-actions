# Setup pbuilder

This action setups pbuilder in GitHub virtual environment

## Inputs

### `dist`

(**REQUIRED**) The distribution we are setting up pbuilder for

### `arch`

(**REQUIRED**) The architecture we are setting up pbuilder for

### `ros-distro`

If set, include the mirror for the provided ROS distribution (note: also honors the `ROS_DISTRO` environment variable).

### `other-mirrors`

Add extra mirrors to the pbuilder image (space separated)

### `other-gpg-keys`

Add extra GPG keys to the pbuilder image (space separated)

## Example usage

```yaml
uses: jrl-umi3218/github-actions/setup-pbuilder@master
with:
  dist: xenial
  arch: amd64
  ros-distro: kinetic
  other-mirrors: https://dl.bintray.com/gergondet/multi-contact-head
  other-gpg-keys: "0x892EA6EE273707C6495A6FB6220D644C64666806"
```
