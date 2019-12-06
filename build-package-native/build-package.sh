#!/bin/bash

@EXTRA_SETUP_COMMANDS@
mk-build-deps -i -r -t "apt-get -y" /tmp/package/Eigen3ToPython/debian/control
cd /package/Eigen3ToPython
sed -i -e's/dh $@\s*$/dh $@ --parallel/' debian/rules
debuild --no-tgz-check -i -I -b -us -uc
