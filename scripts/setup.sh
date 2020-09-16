installBrewfile() {
  echo -e "\033[32mInstalling requirements from Brewfile\033[0m\n"
  brew bundle
}

setupNginx() {
  echo -e "\033[32mInstalling homebrew dependencies\033[0m\n"
  dev-nginx setup-app ./nginx/mapping.yml
}

main() {
  installBrewfile
  setupNginx
  echo -e "\033[32mInstallation complete.\033[0m\n"
}

main
