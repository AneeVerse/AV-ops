# avops-n8n-echo

One tool, `echo_test`, for the Hermes `avops` profile.

Hermes starts this process over stdio. The process POSTs to `http://127.0.0.1:5678/webhook/...` and refuses any other host. The webhook is the n8n workflow `avops-hermes-echo`. A wrong or missing `x-avops-echo` header does not run the success path.

This server cannot list, create, edit, delete, or publish workflows, and it cannot read the n8n credential store.
