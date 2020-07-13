#!/bin/bash

set -e
set -x

export DEBIAN_FRONTEND=noninteractive

setup-conan()
{
  apt-get update -qq
  apt-get install -qq python3-setuptools python3-pip build-essential cmake git gfortran
  pip3 install conan
  conan remote add @CONAN_REPOSITORY@ @CONAN_REMOTE@
  conan profile new default --detect || true
  conan profile update settings.compiler.libcxx=libstdc++11 default
}

setup-conan

conan create . @CONAN_REPOSITORY@/@CONAN_CHANNEL@ -s build_type=Release
conan create . @CONAN_REPOSITORY@/@CONAN_CHANNEL@ -s build_type=Debug

if @CONAN_UPLOAD@
then
  conan user -p @BINTRAY_API_KEY@ -r @CONAN_REPOSITORY@ @CONAN_USER@
  conan alias @CONAN_PACKAGE@/latest@@CONAN_REPOSITORY@/@CONAN_CHANNEL@ @CONAN_PACKAGE@/@CONAN_PACKAGE_VERSION@@@CONAN_REPOSITORY@/@CONAN_CHANNEL@
  conan upload @CONAN_PACKAGE@/@CONAN_PACKAGE_VERSION@@@CONAN_REPOSITORY@/@CONAN_CHANNEL@ --all -r=@CONAN_REPOSITORY@
  conan upload @CONAN_PACKAGE@/latest@@CONAN_REPOSITORY@/@CONAN_CHANNEL@ --all -r=@CONAN_REPOSITORY@
fi
