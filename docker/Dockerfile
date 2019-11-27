ARG DIST
ARG ARCH
ARG ROS_DISTRO=""
FROM ubuntu:18.04

COPY pbuilderrc /root/.pbuilderrc
COPY setup-pbuilder.sh /root/setup-pbuilder.sh
RUN cd /root && ./setup-pbuilder.sh ${DIST} ${ARCH}
