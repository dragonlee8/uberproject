include_recipe 'apt'
include_recipe 'build-essential'
include_recipe 'git'

package 'libc6-dev'
package 'automake'
package 'libtool'
package 'libyaml-dev'
package 'zlib1g'
package 'zlib1g-dev'
package 'openssl'
package 'libssl-dev'
package 'libreadline-dev'
package 'libxml2-dev'
package 'libxslt1-dev'
package 'ncurses-dev'
package 'pkg-config'

execute "install-ruby-build" do
  command "./install.sh"
  user "root"
  cwd "#{node['socialmind']['user_home']}/.ruby-build"
  action :nothing
end

execute "install ruby" do
  command "ruby-build #{node['socialmind']['ruby']} #{node['socialmind']['user_home']}/local/ruby-#{node['socialmind']['ruby']}"
  user node['socialmind']['user']
  creates "#{node['socialmind']['user_home']}/local/ruby-#{node['socialmind']['ruby']}/bin/ruby"
end

execute "set ruby path" do
  command "echo 'export PATH=#{node['socialmind']['user_home']}/local/ruby-#{node['socialmind']['ruby']}/bin/:$PATH' >> .bash_profile"
  user node['socialmind']['user']
  cwd node['socialmind']['user_home']
  not_if "grep 'PATH=#{node['socialmind']['user_home']}/local/ruby-#{node['socialmind']['ruby']}/bin/:$PATH' .bash_profile | grep export"
end
