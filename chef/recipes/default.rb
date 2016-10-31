#
# Cookbook Name:: uber
# Recipe:: default
#
# Copyright 2016, YOUR_COMPANY_NAME
#
# All rights reserved - Do Not Redistribute
#
include_recipe "mongodb::default"

mongodb_instance "uber1" do
  port node['test']['port'] + 100
  dbpath "/data/"
end
