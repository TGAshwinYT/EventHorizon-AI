import { useState } from 'react';

interface AuthProps {
    onLogin: (token: string, username: string) => void;
}

const Auth = ({ onLogin }: AuthProps) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (isLogin) {
                onLogin(data.access_token, data.username);
            } else {
                // Auto login after register or just switch to login?
                // For simplicity, let's switch to login with a success message or just auto-login if the API returned a token (it currently doesn't for register).
                // Let's ask user to login.
                setIsLogin(true);
                setError('Registration successful! Please log in.');
                setPassword('');
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 w-full max-w-md mx-auto shadow-2xl">
            <h2 className="text-3xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                {isLogin ? 'Welcome Back' : 'Join EventHorizon'}
            </h2>

            {error && (
                <div className={`mb-4 p-3 rounded-lg text-sm w-full text-center ${error.includes('successful') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div>
                    <label className="text-sm text-gray-400 mb-1 block">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        required
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-400 mb-1 block">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-2 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                    {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
            </form>

            <div className="mt-6 text-sm text-gray-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    className="text-blue-400 hover:text-blue-300 font-semibold ml-1"
                >
                    {isLogin ? 'Sign Up' : 'Log In'}
                </button>
            </div>
        </div>
    );
};

export default Auth;
