# avops-chat

Hermes starts this process over stdio. Project posts use `send_message` and only succeed for a space listed in `operate.json`. `private: true` is rejected before any API call.

`send_direct_message` opens a one-to-one Chat app conversation. It checks that the destination is `DIRECT_MESSAGE` with `singleUserBotDm: true` and that the human member is the resolved person.

`create_space` creates a new private named space for an authorized owner and the requested email addresses. It does not modify an existing space with the same name and it does not add the new space to `operate.json`. The Chat app is a system member of a space it creates.

Owner checks use the live Admin SDK user record. The owner emails are `mayur@aneeverse.com` and `anees@aneeverse.com`. A name typed in a message is not authorization.

Sends use the Hermes Chat service account. Directory lookup and message history use the `anees@aneeverse.com` refresh token in `oauth.json`, mode 600. That file is not in git. The credential-named space `spaces/AAQACOxtNdo` stays excluded.
