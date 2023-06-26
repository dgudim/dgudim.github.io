cd "$(dirname "$0")" || exit
sass base.scss ../../styles/styles.css
echo "Rendered scss"