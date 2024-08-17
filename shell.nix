{ pkgs ? import <nixpkgs> {} }:

with pkgs;

mkShell {
  packages = [ nodejs_20 jq ];
}
