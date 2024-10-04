window.addEventListener("DOMContentLoaded", (event) => {
  const input = document.querySelector(".notification-form fieldset input");
  const button = document.querySelector(".notification-form fieldset button");
  const status_span = document.querySelector(".notification-form span");
  const emoji_selector = document.querySelector(
    ".notification-form fieldset select",
  );

  if (button != undefined) {
    button.addEventListener("click", () => {
      if (input.value.length > 0) {
        fetch("https://ntfy.sh/kloud-website-notifs", {
          method: "POST",
          body: input.value,
          headers: {
            Title: "> Notification from port0 <",
            Priority: "default",
            Tags: emoji_selector.value,
          },
        });
        status_span.innerHTML = "Sent! :)";
      } else {
        status_span.innerHTML = "C'mon, input something";
      }

      /* reset animation */
      status_span.style.animation = "none";
      status_span.offsetHeight; /* trigger reflow */
      status_span.style.animation = null;

      /* play animation */
      status_span.style.animation = "fadeIn 3s";
    });
  }
});
