#include <iostream>

#include <boost/filesystem.hpp>
namespace bfs = boost::filesystem;

int main()
{
  if(bfs::exists("C:\\"))
  {
    std::cout << "I have C:\\!\n";
  }
  return 0;
}
