FROM ubuntu:18.04

ENV DEBIAN_FRONTEND=noninteractive
ARG DIST
ARG ARCH
ARG ROS_DISTRO=""

WORKDIR /root
COPY ["pbuilderrc","configure-pbuilder.sh", "setup-pbuilder.sh", "/root/"]
RUN ./configure-pbuilder.sh ${DIST} ${ARCH}
