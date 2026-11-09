import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { FaFacebook, FaTwitter, FaInstagram } from 'react-icons/fa';

const HomePage = () => {
  const primaryTeal = '#5bb2b1'; 
  const darkText = '#333333';
  const navigate = useNavigate();
  const scrollToSection = (id) => {
    if (id === 'login') {
      // Chuyển hướng sang trang Login 
      navigate('/login');
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Danh sách menu và id tương ứng
  const navItems = [
    { label: 'HOME', id: 'home' },
    { label: 'ABOUT US', id: 'about' },
    { label: 'DOCTORS', id: 'doctors' },
    { label: 'SERVICES', id: 'services' },
    { label: 'LOGIN', id: 'login' }
  ];

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      
      {/* TOP BAR */}
      <div style={{ 
        backgroundColor: primaryTeal, 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '10px 50px',
        fontSize: '14px'
      }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span><MailOutlined /> clinicnhanhau@gmail.com</span>
          <span><PhoneOutlined /> 123456789</span>
        </div>
        <div style={{ display: 'flex', gap: '15px', fontSize: '18px' }}>
          <FaFacebook style={{ cursor: 'pointer' }} />
          <FaTwitter style={{ cursor: 'pointer' }} />
          <FaInstagram style={{ cursor: 'pointer' }} />
        </div>
      </div>

      {/*NAVIGATION BAR*/}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '20px 50px',
        backgroundColor: 'white',
        borderBottom: '1px solid #eaeaea',
        position: 'sticky', // Giữ menu luôn nổi trên cùng khi cuộn
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            width: '40px', height: '40px', backgroundColor: primaryTeal, 
            borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white' 
          }}>
            💊
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: darkText }}>Clinic</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Care made easy, every visit.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {navItems.map((item) => (
            <Button 
              key={item.label} 
              shape="round" 
              onClick={() => scrollToSection(item.id)} // Gắn sự kiện click
              style={{ border: '1px solid #ccc', color: darkText, fontWeight: '500', padding: '0 20px' }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* HERO SECTION */}
      <div id="home" style={{ 
        backgroundColor: primaryTeal, 
        minHeight: '500px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '50px',
        position: 'relative',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '700px', zIndex: 1 }}>
          <h1 style={{ color: '#1a4342', fontSize: '42px', fontWeight: 'bold', lineHeight: '1.4', marginBottom: '40px' }}>
            Chăm sóc tận tâm, kết nối thông minh – Nâng tầm trải nghiệm sức khỏe của bạn và gia đình
          </h1>
          <Button 
            shape="round" 
            size="large" 
            style={{ 
              backgroundColor: 'white', color: '#1a4342', fontWeight: 'bold', fontSize: '18px',
              padding: '0 40px', height: '50px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}
          >
            Đặt khám ngay
          </Button>
        </div>
      </div>
      {/* 4. WHY CHOOSE US SECTION */}
      <div id="about" style={{ padding: '80px 50px', backgroundColor: 'white', textAlign: 'center' }}>
        <h2 style={{ 
          fontSize: '40px', 
          color: '#333', 
          marginBottom: '40px', 
          fontFamily: 'serif' 
        }}>
          Why Choose Us
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
          {[
            { 
              title: "Đội ngũ chuyên gia (Top Doctors):", 
              desc: "Các bác sĩ đầu ngành, tận tâm và giàu kinh nghiệm.", 
              icon: "👨‍⚕️" // Có thể thay bằng ảnh cắt từ Figma sau
            },
            { 
              title: "Quản lý thông minh (Smart Clinic):", 
              desc: "Hồ sơ bệnh án điện tử an toàn, bảo mật và dễ dàng tra cứu.", 
              icon: "📋" 
            },
            { 
              title: "Đặt lịch nhanh chóng (24/7 Booking):", 
              desc: "Chủ động chọn bác sĩ và thời gian khám chỉ với vài cú click.", 
              icon: "⏰" 
            },
            { 
              title: "Dịch vụ tận tâm (Care & Support):", 
              desc: "Quy trình check-in nhanh chóng, tiết kiệm thời gian chờ đợi tại sảnh.", 
              icon: "🏥" 
            }
          ].map((item, index) => (
            <div key={index} style={{
              backgroundColor: primaryTeal,
              borderRadius: '50px', // Tạo hình dạng viên thuốc (pill shape)
              padding: '15px 25px',
              display: 'flex',
              alignItems: 'center',
              color: 'white',
              textAlign: 'left',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
            }}>
              {/* Khu vực Icon */}
              <div style={{ 
                fontSize: '40px', 
                marginRight: '20px', 
                backgroundColor: 'rgba(255, 255, 255, 0.2)', // Nền trong suốt mờ cho icon
                borderRadius: '50%', 
                minWidth: '70px', 
                height: '70px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}>
                {item.icon}
              </div>
              
              {/* Nội dung Text */}
              <div style={{ fontSize: '18px' }}>
                <span style={{ fontWeight: 'bold' }}>{item.title}</span>
                <span style={{ fontWeight: '400', marginLeft: '8px' }}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 5. MEET OUR EXPERT DOCTORS SECTION */}
      <div id="doctors" style={{ padding: '80px 50px', backgroundColor: '#fcfcfc', textAlign: 'center' }}>
        <h2 style={{ 
          fontSize: '40px', 
          color: '#333', 
          marginBottom: '50px', 
          fontFamily: 'serif' 
        }}>
          Meet Our Expert Doctors
        </h2>
        
        <div style={{ 
          display: 'grid', 
          // Ép buộc chia thành 4 cột bằng nhau trên 1 hàng
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '25px', // Giảm khoảng cách giữa các thẻ xuống một chút
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {[
            { 
              name: "Dr. Maya Chen, MD", 
              specialty: "Tim mạch", 
              desc: "12 năm kinh nghiệm trong lĩnh vực chăm sóc tim mạch, chú trọng vào phòng ngừa và điều trị cá nhân.", 
              img: "/dr-maya.png" 
            },
            { 
              name: "Dr. Liam Reed, MD", 
              specialty: "Chỉnh hình", 
              desc: "Có kinh nghiệm trong lĩnh vực chăm sóc khớp và y học thể thao, giúp bệnh nhân khôi phục sự thoải mái.", 
              img: "/dr-liam.png" 
            },
            { 
              name: "Dr. Sofia Patel, MD", 
              specialty: "Nhi khoa", 
              desc: "Tận tâm chăm sóc sức khỏe trẻ em và thanh thiếu niên với phương pháp tiếp cận ấm áp, gia đình.", 
              img: "/dr-sofia.png" 
            },
            { 
              name: "Dr. Ethan Brooks, MD", 
              specialty: "Da liễu", 
              desc: "Có kinh nghiệm trong lĩnh vực chăm sóc da y khoa, cung cấp các liệu trình điều trị chu đáo.", 
              img: "/dr-ethan.png" 
            }
          ].map((doctor, index) => (
            <div key={index} style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              overflow: 'hidden',
              textAlign: 'left',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Giảm chiều cao khung ảnh từ 280px xuống 180px */}
              <div style={{ height: '180px', backgroundColor: '#e2e8f0' }}>
                <img 
                  src={doctor.img} 
                  alt={doctor.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300x180?text=Image+Not+Found' }} 
                />
              </div>
              
              {/* Giảm nhẹ padding và cỡ chữ để phù hợp với khung nhỏ */}
              <div style={{ padding: '20px', flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#2d3748', fontWeight: 'bold' }}>
                  {doctor.name}
                </h3>
                <p style={{ margin: '0 0 10px 0', color: primaryTeal, fontWeight: '500', fontSize: '14px' }}>
                  {doctor.specialty}
                </p>
                <p style={{ margin: '0', color: '#718096', fontSize: '13px', lineHeight: '1.5' }}>
                  {doctor.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 6. OUR CORE SERVICES SECTION */}
      <div id="services" style={{ padding: '80px 50px', backgroundColor: 'white', textAlign: 'center' }}>
        <h2 style={{ 
          fontSize: '40px', 
          color: '#333', 
          marginBottom: '50px', 
          fontFamily: 'serif' 
        }}>
          Our Core Services
        </h2>
        
        <div style={{ 
          display: 'grid', 
          // Chia thành 3 cột bằng nhau
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '30px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {[
            { 
              title: "Khám Sức khỏe Tổng quát", 
              desc: "Gói khám toàn diện giúp tầm soát, đánh giá chức năng cơ thể và phát hiện sớm các nguy cơ bệnh lý.", 
              icon: "🩺" 
            },
            { 
              title: "Nha khoa", 
              desc: "Dịch vụ làm sạch, trám răng và chăm sóc thẩm mỹ trong không gian thoải mái, thân thiện.", 
              icon: "🦷" 
            },
            { 
              title: "Nhi khoa", 
              desc: "Chăm sóc sức khỏe trẻ em lấy gia đình làm trung tâm, từ các buổi khám định kỳ đến điều trị bệnh cấp tính.", 
              icon: "👶" 
            },
            { 
              title: "Thần kinh học", 
              desc: "Chẩn đoán và điều trị chuyên sâu các bệnh lý liên quan đến hệ thần kinh trung ương và ngoại biên.", 
              icon: "🧠" 
            },
            { 
              title: "Tim mạch học", 
              desc: "Cung cấp các dịch vụ đo điện tâm đồ, siêu âm tim và tầm soát rủi ro tim mạch chuyên nghiệp.", 
              icon: "❤️" 
            },
            { 
              title: "Da liễu", 
              desc: "Chăm sóc và điều trị các vấn đề về da, tóc, móng với phác đồ cá nhân hóa từ bác sĩ chuyên khoa.", 
              icon: "🛡️" 
            }
          ].map((service, index) => (
            <div key={index} style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '40px 30px',
              textAlign: 'left',
              border: '1px solid #eaeaea', // Viền mờ
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              transition: 'transform 0.3s ease', // Hiệu ứng mượt mà (có thể dùng CSS hover sau)
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Icon */}
              <div style={{ 
                fontSize: '28px', 
                backgroundColor: '#e6f4f4', 
                color: primaryTeal,
                borderRadius: '50%', 
                width: '60px', 
                height: '60px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                {service.icon}
              </div>
              
              {/* Nội dung */}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '22px', color: '#333', fontWeight: 'bold' }}>
                  {service.title}
                </h3>
                <p style={{ margin: '0 0 20px 0', color: '#777', fontSize: '15px', lineHeight: '1.6' }}>
                  {service.desc}
                </p>
              </div>

              {/* Nút Learn more */}
              <a href="#" style={{ 
                color: primaryTeal, 
                textDecoration: 'none', 
                fontWeight: '500', 
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                Learn more <span style={{ fontSize: '18px' }}>➔</span>
              </a>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};


export default HomePage;