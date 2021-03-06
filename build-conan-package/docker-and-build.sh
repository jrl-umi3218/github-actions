#!/bin/bash

set -x
set -e

export IMAGE=$1

sudo rm -rf /tmp/package
mkdir -p /tmp/package

cp build-package.sh /tmp/package
sed -i -e"s/@CONAN_REPOSITORY@/${CONAN_REPOSITORY}/g" /tmp/package/build-package.sh
sed -i -e"s#@CONAN_REMOTE@#${CONAN_REMOTE}#g" /tmp/package/build-package.sh
sed -i -e"s#@CONAN_PACKAGE@#${CONAN_PACKAGE}#g" /tmp/package/build-package.sh
sed -i -e"s#@CONAN_PACKAGE_VERSION@#${CONAN_PACKAGE_VERSION}#g" /tmp/package/build-package.sh
sed -i -e"s#@CONAN_CHANNEL@#${CONAN_CHANNEL}#g" /tmp/package/build-package.sh
sed -i -e"s#@CONAN_UPLOAD@#${CONAN_UPLOAD}#g" /tmp/package/build-package.sh
sed -i -e"s#@CONAN_USER@#${CONAN_USER}#g" /tmp/package/build-package.sh
sed -i -e"s#@BINTRAY_API_KEY@#${BINTRAY_API_KEY}#g" /tmp/package/build-package.sh
cat /tmp/package/build-package.sh

cd $GITHUB_WORKSPACE && cd ../
cp -r $WORKING_REPO/ /tmp/package
ls /tmp/package
docker run -v /tmp/package:/package --privileged -t ${IMAGE} /bin/bash -c "cd /package/`basename $WORKING_REPO` && .././build-package.sh" || exit 1
