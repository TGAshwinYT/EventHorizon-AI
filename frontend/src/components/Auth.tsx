import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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
        const trimmedUsername = username.trim();

        if (isReset) {
            if (newPassword !== confirmPassword) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }
            endpoint = '/api/auth/reset-password';
            body = { username: trimmedUsername, new_password: newPassword };
        } else {
            endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            body = { username: trimmedUsername, password };
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
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-[#0D1F16]/95 backdrop-blur-xl rounded-3xl border border-[#1A4731] w-full max-w-md mx-auto shadow-2xl relative overflow-hidden">
            {/* Ambient gold/green accent border glow */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#F5A623]/30 to-transparent pointer-events-none" />

            <div className="mb-6 flex justify-center relative">
                {/* Logo glow */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#1A4731] via-[#F5A623]/40 to-transparent blur-md opacity-70 animate-pulse pointer-events-none" />
                <img src="/logo.png" alt="EventHorizon AI Logo" className="relative w-20 h-20 rounded-full shadow-[0_0_20px_rgba(245,166,35,0.25)] border-2 border-[#1A4731]" />
            </div>

            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] via-white to-[#F5A623] mb-6 text-center tracking-tight">
                {isReset ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Join EventHorizon')}
            </h2>

            {error && (
                <div className={`mb-4 p-3.5 rounded-xl text-xs font-bold w-full text-center ${
                    error.includes('successful') 
                        ? 'bg-[#eef7f2] border border-[#d2edd7] text-[#1A4731]' 
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div>
                    <label className="text-xs font-bold text-[#c0d0c0] uppercase tracking-wider mb-1.5 block">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#0D1F16]/60 border border-[#1A4731]/80 rounded-xl px-4 py-3 text-white focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none transition-all placeholder-[#5a6e5a] font-semibold text-sm"
                        required
                    />
                </div>

                {!isReset && (
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-xs font-bold text-[#c0d0c0] uppercase tracking-wider block">Password</label>
                            {isLogin && (
                                <button
                                    type="button"
                                    onClick={() => { setIsReset(true); setError(''); }}
                                    className="text-xs text-[#F5A623] hover:text-[#d48c17] font-extrabold transition-colors cursor-pointer"
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
                                className="w-full bg-[#0D1F16]/60 border border-[#1A4731]/80 rounded-xl px-4 py-3 text-white focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none transition-all pr-10 placeholder-[#5a6e5a] font-semibold text-sm"
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c0d0c0] hover:text-white transition-colors cursor-pointer"
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
                            <label className="text-xs font-bold text-[#c0d0c0] uppercase tracking-wider mb-1.5 block">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-[#0D1F16]/60 border border-[#1A4731]/80 rounded-xl px-4 py-3 text-white focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none transition-all pr-10 placeholder-[#5a6e5a] font-semibold text-sm"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c0d0c0] hover:text-white transition-colors cursor-pointer"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#c0d0c0] uppercase tracking-wider mb-1.5 block">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-[#0D1F16]/60 border border-[#1A4731]/80 rounded-xl px-4 py-3 text-white focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] outline-none transition-all pr-10 placeholder-[#5a6e5a] font-semibold text-sm"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c0d0c0] hover:text-white transition-colors cursor-pointer"
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
                    className="w-full bg-[#1A4731] hover:bg-[#123323] border border-[#F5A623]/40 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-6 cursor-pointer"
                >
                    {loading ? 'Processing...' : (isReset ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account'))}
                </button>

                {isReset && (
                    <button
                        type="button"
                        onClick={() => { setIsReset(false); setError(''); }}
                        className="w-full text-sm text-[#c0d0c0] hover:text-white font-bold mt-3 transition-colors cursor-pointer"
                    >
                        Back to Login
                    </button>
                )}
            </form>

            {!isReset && (
                <div className="mt-6 text-sm text-[#c0d0c0] font-semibold">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-[#F5A623] hover:text-[#d48c17] font-extrabold ml-1 cursor-pointer transition-colors"
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Auth;
