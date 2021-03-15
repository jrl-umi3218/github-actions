cmake_minimum_required(VERSION 3.1)

project(boost-project LANGUAGES CXX VERSION 1.0.0)
enable_testing()

find_package(Boost REQUIRED COMPONENTS filesystem)

add_executable(main main.cpp)
target_link_libraries(main PUBLIC Boost::filesystem)

add_test(main main)
