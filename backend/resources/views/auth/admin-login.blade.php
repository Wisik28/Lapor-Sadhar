```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Admin - Lapor-Sadhar</title>

    <style>
        * { box-sizing: border-box; }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f1f5f9;
            color: #1e293b;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 24px;
        }

        .card {
            background: white;
            width: 100%;
            max-width: 430px;
            padding: 32px;
            border-radius: 16px;
            box-shadow: 0 8px 30px #0f172a12;
        }

        h1 { margin-top: 0; font-size: 25px; }

        .subtitle {
            color: #64748b;
            margin-bottom: 24px;
        }

        label {
            display: block;
            margin: 16px 0 7px;
            font-weight: 600;
            font-size: 14px;
        }

        input {
            width: 100%;
            padding: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 15px;
        }

        button {
            width: 100%;
            margin-top: 24px;
            padding: 13px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        }

        .link {
            text-align: center;
            margin-top: 20px;
        }

        a { color: #2563eb; }

        .error {
            color: #b91c1c;
            background: #fef2f2;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
    </style>
</head>

<body>
    <main class="card">
        <h1>Login Admin</h1>
        <p class="subtitle">
            Masuk ke panel admin Lapor-Sadhar.
        </p>

        @if ($errors->any())
            <div class="error">
                @foreach ($errors->all() as $error)
                    <div>{{ $error }}</div>
                @endforeach
            </div>
        @endif

        <form method="POST" action="{{ route('admin.login.submit') }}">
            @csrf

            <label for="username">Username</label>
            <input
                id="username"
                type="text"
                name="username"
                value="{{ old('username') }}"
                required
                autofocus
            >

            <label for="password">Password</label>
            <input
                id="password"
                type="password"
                name="password"
                required
            >

            <button type="submit">Login sebagai Admin</button>
        </form>

        <p class="link">
            <a href="{{ route('mahasiswa.login') }}">
                Login sebagai mahasiswa
            </a>
        </p>
    </main>
</body>
</html>
```