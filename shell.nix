{ pkgs ? import <nixpkgs> {} }:

let
  inherit (pkgs.stdenv.hostPlatform) system;

  releases = {
    "x86_64-linux" = {
      name = "astra-cli-0.5-linux.zip";
      hash = "sha256-Gr+OIi2M/05DWV4XjZ8fDxeXyUyz/tUT/Qzl9BhvXog=";
    };
    "aarch64-linux" = {
      name = "astra-cli-0.5-linux.zip";
      hash = "sha256-Gr+OIi2M/05DWV4XjZ8fDxeXyUyz/tUT/Qzl9BhvXog=";
    };
    "x86_64-darwin" = {
      name = "astra-cli-0.5-mac.zip";
      hash = "sha256-g7wAyNSDns6y+XB+dbBeYILEm2jDFYNvZCm/U9N+fk8=";
    };
    "aarch64-darwin" = {
      name = "astra-cli-0.5-mac.zip";
      hash = "sha256-g7wAyNSDns6y+XB+dbBeYILEm2jDFYNvZCm/U9N+fk8=";
    };
  }.${system} or (throw "Unsupported system: ${system}");

  astra = pkgs.stdenv.mkDerivation rec {
    pname = "astra";
    version = "0.5";

    nativeBuildInputs = with pkgs; [ unzip ];

    src = pkgs.fetchurl {
      url = "https://github.com/datastax/astra-cli/releases/download/${version}/${releases.name}";
      hash = releases.hash;
    };

    unpackPhase = ''
      unzip $src
    '';

    installPhase = ''
      install -m755 -D astra $out/bin/${pname}
      install -m755 -D astra-init.sh $out/bin/${pname}-init
    '';
  };
in

pkgs.mkShell {
  packages = [ pkgs.nodejs_20 pkgs.jq astra ];
}
