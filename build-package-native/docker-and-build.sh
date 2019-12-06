#!/bin/bash

set -x

mkdir -p /tmp/package
mkdir -p /tmp/packages-${DOCKER_TAG}
sed -i -e"s#@EXTRA_SETUP_COMMANDS@#${EXTRA_SETUP_COMMANDS}#" build-package.sh
echo "::group::build-package.sh"
cat build-package.sh
echo "::endgroup::"
cp build-package.sh /tmp/package
cp -r $GITHUB_WORKSPACE /tmp/package/
docker run -v /tmp/package:/package --privileged -t gergondet/pbuilder:${DOCKER_TAG} /bin/bash -c "/package/build-package.sh"
mv /tmp/package/*.deb /tmp/packages-${DOCKER_TAG}
