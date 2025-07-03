export default function Loading() {
    return (
        <div className="fixed inset-0 bg-black flex items-center justify-center">
            <img
                src="/loading.gif"
                alt="Loading..."
                className="w-32 h-32"
            />
        </div>
    );
}
