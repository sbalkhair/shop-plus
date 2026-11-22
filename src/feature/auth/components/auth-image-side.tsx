const AuthImageSide = () => {
  return (
    <div className="relative hidden bg-muted lg:block">
      <div className="absolute inset-0 z-10 flex items-center justify-center text-lg font-semibold">
        {/* <div className="rounded-xl bg-white/40 px-10 py-3 text-white">
          <div></div>
        </div> */}
      </div>
      <img
        src="/auth-bg.jpg"
        alt="Image"
        className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
      />
    </div>
  )
}

export default AuthImageSide
