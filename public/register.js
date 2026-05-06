// ===== REGISTER.JS =====

let selectedRole = '';
let generatedOTP = '';
let timerInterval = null;
let pendingUser = null;

// ---- STEP 1 ----
async function goStep2() {
  const name     = document.getElementById('regName').value.trim();
  const phone    = document.getElementById('regPhone').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const address  = document.getElementById('regAddress').value.trim();

  if (!name || !phone || !email || !password || !address) {
    alert('Please fill all required fields.');
    return;
  }
  if (password.length < 8) {
    alert('Password must be at least 8 characters.');
    return;
  }

  // Check duplicate email via API
  try {
    const users = await getUsers();
    if (users.find(u => u.email === email)) {
      alert('An account with this email already exists.');
      return;
    }
  } catch {
    // If server unreachable just continue — server will reject duplicates on submit
  }

  pendingUser = { name, phone, email, password, address };
  goStep(2);
}

// ---- STEP 2 ----
function selectRole(role) {
  selectedRole = role;
  document.getElementById('donorCard').classList.toggle('selected', role === 'donor');
  document.getElementById('receiverCard').classList.toggle('selected', role === 'receiver');
  document.getElementById('step2Next').disabled = false;
  document.getElementById('receiverNotice').style.display = role === 'receiver' ? 'flex' : 'none';
}

function goStep3() {
  if (!selectedRole) { alert('Please select a role.'); return; }
  document.getElementById('otpPhoneDisplay').textContent = pendingUser.phone;
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  document.getElementById('demoOtpDisplay').textContent = generatedOTP;
  startOTPTimer();
  goStep(3);
}

// ---- OTP TIMER ----
function startOTPTimer() {
  let count = 60;
  document.getElementById('timerCount').textContent = count;
  document.getElementById('otpTimer').style.display = 'block';
  document.getElementById('resendBtn').style.display = 'none';
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    count--;
    document.getElementById('timerCount').textContent = count;
    if (count <= 0) {
      clearInterval(timerInterval);
      document.getElementById('otpTimer').style.display = 'none';
      document.getElementById('resendBtn').style.display = 'inline';
    }
  }, 1000);
}

function resendOTP() {
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  document.getElementById('demoOtpDisplay').textContent = generatedOTP;
  document.getElementById('otpError').textContent = '';
  document.querySelectorAll('.otp-box').forEach(b => { b.value = ''; b.classList.remove('filled'); });
  startOTPTimer();
}

function otpInput(index) {
  const box = document.getElementById('otp' + index);
  const val = box.value.replace(/[^0-9]/g, '');
  box.value = val;
  box.classList.toggle('filled', val !== '');
  if (val && index < 5) {
    document.getElementById('otp' + (index + 1)).focus();
  }
}

function getEnteredOTP() {
  return Array.from({length: 6}, (_, i) => document.getElementById('otp' + i).value).join('');
}

async function verifyOTP() {
  const entered = getEnteredOTP();
  if (entered.length < 6) {
    document.getElementById('otpError').textContent = 'Please enter all 6 digits.';
    return;
  }
  if (entered !== generatedOTP) {
    document.getElementById('otpError').textContent = '✗ Incorrect OTP. Please try again.';
    document.querySelectorAll('.otp-box').forEach(b => { b.style.borderColor = 'var(--red)'; });
    return;
  }

  clearInterval(timerInterval);
  await doRegisterUser();
}

async function doRegisterUser() {
  const submitBtn = document.getElementById('step3VerifyBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating account…'; }

  try {
    const data = await registerUser({
      name:     pendingUser.name,
      phone:    pendingUser.phone,
      email:    pendingUser.email,
      password: pendingUser.password,
      address:  pendingUser.address,
      role:     selectedRole,
    });

    setCurrentUser(data.user);
    goStep(4);

    const isPending = selectedRole === 'receiver';
    const icon  = document.getElementById('successIcon');
    const title = document.getElementById('successTitle');
    const msg   = document.getElementById('successMsg');

    if (isPending) {
      icon.textContent = '⏳';
      icon.classList.add('pending');
      title.textContent = 'Registration Submitted!';
      msg.textContent = 'Your receiver account is pending admin approval. You will be notified once approved. You can still log in to check your status.';
    } else {
      icon.textContent = '✓';
      title.textContent = 'Welcome to NourishNet!';
      msg.textContent = 'Your donor account has been created successfully. You can now log in and start making a difference!';
    }
  } catch (err) {
    document.getElementById('otpError').textContent = '✗ ' + (err.message || 'Registration failed. Please try again.');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify & Register'; }
  }
}

// ---- STEP NAVIGATION ----
function goStep(n) {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById('step' + i);
    const dot  = document.getElementById('step-dot-' + i);
    if (step) step.classList.toggle('active', i === n);
    if (dot) {
      dot.classList.toggle('active', i === n);
      dot.classList.toggle('done', i < n);
    }
  }
  // Step lines
  const lines = document.querySelectorAll('.step-line');
  lines.forEach((line, i) => {
    line.classList.toggle('done', i < n - 1);
  });
}

// ---- PASSWORD STRENGTH ----
document.addEventListener('DOMContentLoaded', () => {
  const pwdInput = document.getElementById('regPassword');
  if (!pwdInput) return;
  pwdInput.addEventListener('input', () => {
    const val = pwdInput.value;
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const fill = document.getElementById('strengthFill');
    const text = document.getElementById('strengthText');
    const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#22C55E'];
    const labels = ['Weak', 'Fair', 'Good', 'Strong'];
    const pct = (score / 4) * 100;
    fill.style.width = pct + '%';
    fill.style.background = colors[score - 1] || '#e5e7eb';
    text.textContent = val ? (labels[score - 1] || '') : '';
    text.style.color = colors[score - 1] || '';
  });

  // OTP keyboard navigation (backspace)
  document.querySelectorAll('.otp-box').forEach((box, i) => {
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        document.getElementById('otp' + (i - 1)).focus();
      }
    });
  });
});
