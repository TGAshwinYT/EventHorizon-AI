import { useState } from 'react';

interface AuthProps {
    onLogin: (token: string, username: string) => void;
}

const Auth = ({ onLogin }: AuthProps) => {
    const [isLogin, setIsLogin] = useState(true);
    const [isReset, setIsReset] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        let endpoint = '';
        let body = {};

        if (isReset) {
            if (newPassword !== confirmPassword) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }
            endpoint = '/api/auth/reset-password';
            body = { username, new_password: newPassword };
        } else {
            endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            body = { username, password };
        }

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || data.error || 'Authentication failed');
            }

            if (isReset) {
                setIsReset(false);
                setIsLogin(true);
                setError('Password reset successful! Please log in.');
                setPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else if (isLogin) {
                onLogin(data.access_token, data.username);
            } else {
                // Auto login after register or just switch to login?
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
                {isReset ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Join EventHorizon')}
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

                {!isReset && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-sm text-gray-400 block">Password</label>
                            {isLogin && (
                                <button
                                    type="button"
                                    onClick={() => { setIsReset(true); setError(''); }}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                    Forgot Password?
                                </button>
                            )}
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            required
                        />
                    </div>
                )}

                {isReset && (
                    <>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                            />
                        </div>
                    </>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-2 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                    {loading ? 'Processing...' : (isReset ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account'))}
                </button>

                {isReset && (
                    <button
                        type="button"
                        onClick={() => { setIsReset(false); setError(''); }}
                        className="w-full text-sm text-gray-400 hover:text-white mt-2"
                    >
                        Back to Login
                    </button>
                )}
            </form>

            {!isReset && (
                <div className="mt-6 text-sm text-gray-400">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-blue-400 hover:text-blue-300 font-semibold ml-1"
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Auth;
