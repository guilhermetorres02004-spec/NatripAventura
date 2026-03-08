$env:PAYPAL_CLIENT_ID='AfSA4W32kTqZ6zGXfj5OU1BKt1CIAj8klNI5lugtWPvkam8_jN2KZS11ld5pZFposuC8yNbBYsUaoKaT'
$env:PAYPAL_SECRET='EFiMP5v8g_mGAKXEi7T1VU5bTNNmX25uREWcUC4t0JRiW_kFmJBvRvWiGVt6px1CX2ZmKqGSopSFhr88'
$env:PAYPAL_MODE='sandbox'
# kill existing node processes (if any)
try { taskkill /F /IM node.exe /T } catch {}
# start server in this shell
node server.js
