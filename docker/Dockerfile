FROM ubuntu:18.04

ENV DEBIAN_FRONTEND=noninteractive
ARG DIST
ARG ARCH
ARG ROS_DISTRO=""

COPY ["pbuilderrc","setup-pbuilder.sh", "/root/"]
RUN cd /root && ./setup-pbuilder.sh ${DIST} ${ARCH}
