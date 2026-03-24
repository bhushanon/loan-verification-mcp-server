import java.sql.*;
import java.io.*;
import javax.servlet.*;
import javax.servlet.http.*;

public class VulnerableServlet extends HttpServlet {

    // ⚠️ Hardcoded credentials (Sensitive Data Exposure)
    private static final String DB_URL = "jdbc:mysql://localhost:3306/test23";
    private static final String USER = "root";
    private static final String PASS = "password123";

    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String username = request.getParameter("username");

        try {
            Connection conn = DriverManager.getConnection(DB_URL, USER, PASS);

            // ❌ SQL Injection vulnerability
            String query = "SELECT * FROM users WHERE username = '" + username + "'";
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(query);

            PrintWriter out = response.getWriter();

            while (rs.next()) {
                out.println("User: " + rs.getString("username"));
            }

            // ❌ XSS vulnerability (reflecting input)
            out.println("You searched for: " + username);

            // ❌ Insecure file access (Path Traversal)
            String file = request.getParameter("file");
            if (file != null) {
                BufferedReader reader = new BufferedReader(new FileReader("/var/data/" + file));
                out.println(reader.readLine());
                reader.close();
            }

            conn.close();

        } catch (Exception e) {
            // ❌ Information leakage
            e.printStackTrace(response.getWriter());
        }
    }
}
