function openLogin() {
    window.location.href = "/student";
}

document.addEventListener("DOMContentLoaded", function() {
    api.getCurrentUser().then(function(response) {
        const user = response.user;
        if (user && user.role === "admin") {
            window.location.replace("/admin");
        } else if (user && user.role === "student") {
            window.location.replace("/student");
        }
    }).catch(function(error) {
        if (error.status !== 401) {
            console.error("Unable to restore the existing login session:", error);
        }
    });
});