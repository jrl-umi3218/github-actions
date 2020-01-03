#!/bin/bash

GH_USER=$1
GH_PAGES_TOKEN=$2
GH_REPOSITORY=$3

set -x
git config --global user.name "JRL/IDH Continuous Integration Tool"
git config --global user.email "jrl-idh+ci@gmail.com"
cd $GITHUB_WORKSPACE
git remote set-url origin "https://$GH_USER:$GH_PAGES_TOKEN@github.com/$GH_REPOSITORY"
if `git fetch --depth=1 origin gh-pages:gh-pages`; then
  sudo chown -R `whoami` build/
  if [ -d doc/pictures ]
  then
    cp -r doc/pictures build/doc/doxygen-html/
  fi
  cd build/doc && $GITHUB_WORKSPACE/cmake/github/update-doxygen-doc.sh -r $GITHUB_WORKSPACE -b $GITHUB_WORKSPACE/build
fi
