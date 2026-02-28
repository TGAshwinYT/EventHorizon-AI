import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import api from '../api';

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

    // Visibility toggle states
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
            const res = await api.post(endpoint, body);
            const data = res.data;

            if (isReset) {
                setIsReset(false);
                setIsLogin(true);
                setError('Password reset successful! Please log in.');
                setPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setShowPassword(false);
                setShowNewPassword(false);
                setShowConfirmPassword(false);
            } else if (isLogin) {
                onLogin(data.access_token, data.username);
            } else {
                // Auto login after register or just switch to login?
                setIsLogin(true);
                setError('Registration successful! Please log in.');
                setPassword('');
            }

        } catch (err: any) {
            setError(err.response?.data?.detail || err.response?.data?.error || err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 w-full max-w-md mx-auto shadow-2xl">
            <div className="mb-6 flex justify-center">
                <img src="/logo.png" alt="EventHorizon AI Logo" className="w-20 h-20 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] border-2 border-white/10" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 text-center">
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
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                )}

                {isReset && (
                    <>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
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
